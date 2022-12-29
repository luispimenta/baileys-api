import { getSession, onWhatsApp } from './../whatsapp.js'
import response from './../response.js'

const checkOnWhatsapp = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const number = req.body.number

    try {
        const data = await onWhatsApp(session, number)

        response(res, 200, true, data)
    } catch {
        response(res, 500, false, 'Failed to get group metadata.')
    }
}

export { checkOnWhatsapp }
