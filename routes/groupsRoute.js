import { Router } from 'express'
import { body, query } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import * as controller from './../controllers/groupsController.js'
import getMessages from './../controllers/getMessages.js'

const router = Router()

router.get('/', query('id').notEmpty(), requestValidator, sessionValidator, controller.getList)

router.get('/:jid', query('id').notEmpty(), requestValidator, sessionValidator, getMessages)

router.get('/meta/:jid', query('id').notEmpty(), requestValidator, sessionValidator, controller.getGroupMetaData)

router.post(
    '/send',
    query('id').notEmpty(),
    body('receiver').notEmpty(),
    body('message').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.send
)

router.post(
    '/updatesubject',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    body('subject').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.updateSubject
)

router.post(
    '/updatedescription',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    body('description').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.updateDescription
)

router.post(
    '/updatesetting',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    body('action').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.updateSetting
)

router.post(
    '/updatepicture',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    body('url').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.updatePicture
)

router.post(
    '/invitecode',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.inviteCode
)

router.post(
    '/creategroup',
    query('id').notEmpty(),
    body('name').notEmpty(),
    body('users').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.createGroup
)

router.post(
    '/participantsupdate',
    query('id').notEmpty(),
    body('jid').notEmpty(),
    body('users').notEmpty(),
    body('action').notEmpty(),
    requestValidator,
    sessionValidator,
    controller.participantsUpdate
)

export default router
