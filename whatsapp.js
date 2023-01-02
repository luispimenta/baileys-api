import { rmSync, readdir } from 'fs'
import { join } from 'path'
import pino from 'pino'
import makeWASocket, {
    makeWALegacySocket,
    useMultiFileAuthState,
    useSingleFileLegacyAuthState,
    makeInMemoryStore,
    Browsers,
    DisconnectReason,
    delay,
} from '@adiwajshing/baileys'
import { toDataURL } from 'qrcode'
import __dirname from './dirname.js'
import response from './response.js'
import axios from 'axios';

const sessions = new Map()
const retries = new Map()

const axiosInstance = axios.create({
    baseURL: process.env.WEBHOOK_URL || '',
})

const sessionsDir = (sessionId = '') => {
    return join(__dirname, 'sessions', sessionId ? sessionId : '')
}

const isSessionExists = (sessionId) => {
    return sessions.has(sessionId)
}

const shouldReconnect = (sessionId) => {
    let maxRetries = parseInt(process.env.MAX_RETRIES ?? 0)
    let attempts = retries.get(sessionId) ?? 0

    maxRetries = maxRetries < 1 ? 1 : maxRetries

    if (attempts < maxRetries) {
        ++attempts

        console.log('Reconnecting...', { attempts, sessionId })
        retries.set(sessionId, attempts)

        return true
    }

    return false
}

const createSession = async (sessionId, isLegacy = false, res = null) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')

    const logger = pino({ level: 'warn' })
    const store = makeInMemoryStore({ logger })

    let state, saveState

    if (isLegacy) {
        ;({ state, saveState } = useSingleFileLegacyAuthState(sessionsDir(sessionFile)))
    } else {
        ;({ state, saveCreds: saveState } = await useMultiFileAuthState(sessionsDir(sessionFile)))
    }

    /**
     * @type {import('@adiwajshing/baileys').CommonSocketConfig}
     */
    const waConfig = {
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: Browsers.ubuntu('Chrome'),
    }

    /**
     * @type {import('@adiwajshing/baileys').AnyWASocket}
     */
    const wa = isLegacy ? makeWALegacySocket(waConfig) : makeWASocket.default(waConfig)

    if (!isLegacy) {
        store.readFromFile(sessionsDir(`${sessionId}_store.json`))
        setInterval(() => {
          store.writeToFile(sessionsDir(`${sessionId}_store.json`))
        }, 10_000)
        store.bind(wa.ev)
    }

    sessions.set(sessionId, { ...wa, store, isLegacy })

    wa.ev.on('creds.update', saveState)

    wa.ev.on('chats.set', ({ chats }) => {
        if (isLegacy) {
            store.chats.insertIfAbsent(...chats)
        }
    })

    wa.ev.on('messages.upsert', async (m) => {
        await sendWebhook('messages.upsert', m, sessionId)
    })

    wa.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        const statusCode = lastDisconnect?.error?.output?.statusCode

        if (connection === 'open') {
            retries.delete(sessionId)
        }

        if (connection === 'close') {
            if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
                if (res && !res.headersSent) {
                    response(res, 500, false, 'Unable to create session.')
                }

                return deleteSession(sessionId, isLegacy)
            }

            setTimeout(
                () => {
                    createSession(sessionId, isLegacy, res)
                },
                statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 0)
            )
        }

        if (update.qr) {
            if (res && !res.headersSent) {
                try {
                    const qr = await toDataURL(update.qr)

                    response(res, 200, true, 'QR code received, please scan the QR code.', { qr })

                    return
                } catch {
                    response(res, 500, false, 'Unable to create QR code.')
                }
            }

            try {
                await wa.logout()
            } catch {
            } finally {
                deleteSession(sessionId, isLegacy)
            }
        }
    })
}

/**
 * @returns {(import('@adiwajshing/baileys').AnyWASocket|null)}
 */
const getSession = (sessionId) => {
    return sessions.get(sessionId) ?? null
}

const deleteSession = (sessionId, isLegacy = false) => {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')
    const storeFile = `${sessionId}_store.json`
    const rmOptions = { force: true, recursive: true }

    rmSync(sessionsDir(sessionFile), rmOptions)
    rmSync(sessionsDir(storeFile), rmOptions)

    sessions.delete(sessionId)
    retries.delete(sessionId)
}

const getChatList = (sessionId, isGroup = false) => {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net'

    return getSession(sessionId).store.chats.filter((chat) => {
        return chat.id.endsWith(filter)
    })
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const isExists = async (session, jid, isGroup = false) => {
    try {
        let result

        if (isGroup) {
            result = await session.groupMetadata(jid)

            return Boolean(result.id)
        }

        if (session.isLegacy) {
            result = await session.onWhatsApp(jid)
        } else {
            ;[result] = await session.onWhatsApp(jid)
        }

        return result.exists
    } catch {
        return false
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const sendMessage = async (session, receiver, message, delayMs = 1000) => {
    try {
        await delay(parseInt(delayMs))

        return session.sendMessage(receiver, message)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

const formatPhone = (phone) => {
    if (phone.endsWith('@s.whatsapp.net')) {
        return phone
    }

    let formatted = phone.replace(/\D/g, '')

    return (formatted += '@s.whatsapp.net')
}

const formatGroup = (group) => {
    if (group.endsWith('@g.us')) {
        return group
    }

    let formatted = group.replace(/[^\d-]/g, '')

    return (formatted += '@g.us')
}

const cleanup = () => {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
        if (!session.isLegacy) {
            session.store.writeToFile(sessionsDir(`${sessionId}_store.json`))
        }
    })
}

const init = () => {
    readdir(sessionsDir(), (err, files) => {
        if (err) {
            throw err
        }

        for (const file of files) {
            if ((!file.startsWith('md_') && !file.startsWith('legacy_')) || file.endsWith('_store')) {
                continue
            }

            const filename = file.replace('.json', '')
            const isLegacy = filename.split('_', 1)[0] !== 'md'
            const sessionId = filename.substring(isLegacy ? 7 : 3)

            createSession(sessionId, isLegacy)
        }
    })
}

const getWhatsAppId = (id) => {
    if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id
    return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`
}

const parseParticipants = (users) => {
    return users.map((users) => getWhatsAppId(users))
}

const sendWebhook = async (type, body, key) => {
    if (!process.env.WEBHOOK_ENABLED) return
    axiosInstance.post('', { type, body, instanceKey: key }).catch(() => { })
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupUpdateSubject = async (session, jid, subject) => {
    try {
        return session.groupUpdateSubject(jid, subject)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupUpdateDescription = async (session, jid, description) => {
    try {
        return session.groupUpdateDescription(jid, description)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupSettingUpdate = async (session, jid, action) => {
    try {
        return session.groupSettingUpdate(jid, action)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const updateProfilePicture = async (session, jid, url) => {
    try {
        const img = await axios.get(url, { responseType: 'arraybuffer' })
        return session.updateProfilePicture(jid, img.data)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupInviteCode = async (session, jid) => {
    try {
        return session.groupInviteCode(jid)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupCreate = async (session, name, users) => {
    try {
        return session.groupCreate(name, users.map(getWhatsAppId))
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupParticipantsUpdate = async (session, jid, users, action) => {
    try {
        return session.groupParticipantsUpdate(jid, parseParticipants(users), action)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const onWhatsApp = async (session, number) => {
    try {
        if (number.includes('@g.us')) return [{ exists: true }]
        return await session.onWhatsApp(number)
    } catch {
        return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
    }
}

/**
 * @param {import('@adiwajshing/baileys').AnyWASocket} session
 */
const groupFetchAllParticipating = async (session) => {
  try {
      return await session.groupFetchAllParticipating()
  } catch {
      return Promise.reject(null) // eslint-disable-line prefer-promise-reject-errors
  }
}

export {
    isSessionExists,
    createSession,
    getSession,
    deleteSession,
    getChatList,
    isExists,
    sendMessage,
    formatPhone,
    formatGroup,
    cleanup,
    init,
    groupUpdateSubject,
    groupUpdateDescription,
    groupSettingUpdate,
    updateProfilePicture,
    groupInviteCode,
    groupCreate,
    groupParticipantsUpdate,
    onWhatsApp,
    groupFetchAllParticipating
}
