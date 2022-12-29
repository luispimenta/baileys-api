import { Router } from 'express'
import { body, query } from 'express-validator'
import requestValidator from './../middlewares/requestValidator.js'
import sessionValidator from './../middlewares/sessionValidator.js'
import * as controller from './../controllers/miscController.js'

const router = Router()

router.get('/', query('id').notEmpty(), body('number').notEmpty(), requestValidator, sessionValidator, controller.checkOnWhatsapp)

export default router
