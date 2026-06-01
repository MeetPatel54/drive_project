const express = require("express");
const router = express.Router();
const { register, login, getMe, updateMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { validate, registerSchema, loginSchema, updateProfileSchema } = require("../validators");

router.post("/register", validate(registerSchema), register);
router.post("/login",    validate(loginSchema),    login);
router.get("/me",        protect,                  getMe);
router.patch("/me",      protect, validate(updateProfileSchema), updateMe);

module.exports = router;
