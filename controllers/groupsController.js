import { getSession, getChatList, isExists, sendMessage, formatGroup, groupUpdateSubject, groupUpdateDescription, groupSettingUpdate, updateProfilePicture, groupInviteCode, groupCreate, groupParticipantsUpdate, groupFetchAllParticipating } from './../whatsapp.js'
import response from './../response.js'

const getList = (req, res) => {
    return response(res, 200, true, '', getChatList(res.locals.sessionId, true))
}

const getGroupMetaData = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const { jid } = req.params

    try {
        const data = await session.groupMetadata(jid)

        if (!data.id) {
            return response(res, 400, false, 'The group is not exists.')
        }

        response(res, 200, true, '', data)
    } catch {
        response(res, 500, false, 'Failed to get group metadata.')
    }
}

const send = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { message } = req.body

    try {
        const exists = await isExists(session, receiver, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await sendMessage(session, receiver, message)

        response(res, 200, true, 'The message has been successfully sent.')
    } catch {
        response(res, 500, false, 'Failed to send the message.')
    }
}

const updateSubject = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)
    const subject = req.body.subject

    try {
        const exists = await isExists(session, jid, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await groupUpdateSubject(session, jid, subject)

        response(res, 200, true, 'The subject has been successfully updated.')
    } catch {
        response(res, 500, false, 'Failed to update the subject.')
    }
}

const updateDescription = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)
    const description = req.body.description

    try {
        const exists = await isExists(session, jid, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await groupUpdateDescription(session, jid, description)

        response(res, 200, true, 'The description has been successfully updated.')
    } catch {
        response(res, 500, false, 'Failed to update the description.')
    }
}

const updateSetting = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)
    const action = req.body.action

    try {
        const exists = await isExists(session, jid, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await groupSettingUpdate(session, jid, action)

        response(res, 200, true, 'The setting has been successfully updated.')
    } catch {
        response(res, 500, false, 'Failed to update the setting.')
    }
}

const updatePicture = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)
    const url = req.body.url

    try {
        const exists = await isExists(session, jid, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        await updateProfilePicture(session, jid, url)

        response(res, 200, true, 'The profile picture has been successfully updated.')
    } catch {
        response(res, 500, false, 'Failed to update the profile picuture.')
    }
}

const inviteCode = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)

    try {
        const exists = await isExists(session, jid, true)

        if (!exists) {
            return response(res, 400, false, 'The group is not exists.')
        }

        const data = await groupInviteCode(session, jid)

        response(res, 200, true, 'https://chat.whatsapp.com/' + data)
    } catch {
        response(res, 500, false, 'Failed to get invite group.')
    }
}

const createGroup = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const name = req.body.name
    const users = req.body.users

    try {
        const data = await groupCreate(session, name, users)

        response(res, 200, true, data)
    } catch {
        response(res, 500, false, 'Failed to create a new group.')
    }
}

const participantsUpdate = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const jid = formatGroup(req.body.jid)
    const users = req.body.users
    const action = req.body.action

    try {
        await groupParticipantsUpdate(session, jid, users, action)

        response(res, 200, true, 'The participants has been successfully updated.')
    } catch {
        response(res, 500, false, 'Failed to participants update.')
    }
}

const getAllparticipants = async (req, res) => {
    const session = getSession(res.locals.sessionId)

    try {
        const data = await groupFetchAllParticipating(session)

        response(res, 200, true, data)
    } catch {
        response(res, 500, false, 'Failed to get all participants.')
    }
}


export { getList, getGroupMetaData, send, updateSubject, updateDescription, updateSetting, updatePicture, inviteCode, createGroup, participantsUpdate, getAllparticipants }
