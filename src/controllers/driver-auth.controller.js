const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Driver } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";
const BCRYPT_SALT_ROUNDS = 10;

exports.checkPhone = async (req, res) => {
    try {
        let { phone } = req.body;
        if (!phone) return res.status(400).json({ message: "Phone is required" });

        phone = phone.trim();

        const driver = await Driver.findOne({ where: { courierPhone: phone } });
        if (!driver) {
            return res.status(200).json({ exists: false, message: "رقم الموبايل غير مسجل" });
        }

        const hasPassword = !!driver.password;
        return res.json({ exists: true, hasPassword });
    } catch (e) {
        console.error("checkPhone error:", e);
        return res.status(500).json({ message: "خطأ في السيرفر" });
    }
};

exports.verifyId = async (req, res) => {
    try {
        let { phone, nationalIdLast4 } = req.body;
        if (!phone || !nationalIdLast4) return res.status(400).json({ message: "البيانات ناقصة" });

        phone = phone.trim();

        const driver = await Driver.findOne({ where: { courierPhone: phone } });
        if (!driver) return res.status(404).json({ message: "رقم الموبايل غير مسجل" });

        if (!driver.courierId) {
            return res.status(200).json({ success: false, message: "لا يوجد رقم قومي مسجل لهذا المندوب، يرجى مراجعة الإدارة" });
        }

        const actualLast4 = driver.courierId.slice(-4);
        if (actualLast4 !== String(nationalIdLast4)) {
            return res.status(200).json({ success: false, message: "آخر 4 أرقام غير صحيحة" });
        }

        return res.json({ success: true, message: "تم التحقق بنجاح" });
    } catch (e) {
        console.error("verifyId error:", e);
        return res.status(500).json({ message: "خطأ في السيرفر" });
    }
};

exports.setPassword = async (req, res) => {
    try {
        let { phone, nationalIdLast4, password } = req.body;
        if (!phone || !nationalIdLast4 || !password) return res.status(400).json({ message: "البيانات ناقصة" });

        phone = phone.trim();

        const driver = await Driver.findOne({ where: { courierPhone: phone } });
        if (!driver) return res.status(404).json({ message: "رقم الموبايل غير مسجل" });

        if (!driver.courierId || driver.courierId.slice(-4) !== String(nationalIdLast4)) {
            return res.status(200).json({ success: false, message: "بيانات التحقق غير صحيحة" });
        }

        driver.password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        await driver.save();

        const token = jwt.sign(
            { id: driver.id, role: "driver", phone: driver.courierPhone },
            JWT_SECRET,
            { expiresIn: "30d" }
        );

        return res.json({ token, driverId: driver.id, message: "تم تعيين كلمة المرور بنجاح" });
    } catch (e) {
        console.error("setPassword error:", e);
        return res.status(500).json({ message: "خطأ في السيرفر" });
    }
};

exports.login = async (req, res) => {
    try {
        let { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ message: "رقم الموبايل وكلمة المرور مطلوبة" });

        phone = phone.trim();

        const driver = await Driver.findOne({ where: { courierPhone: phone } });
        if (!driver) return res.status(404).json({ message: "رقم الموبايل غير مسجل" });

        if (!driver.password) {
            return res.status(400).json({ message: "لم يتم تعيين كلمة مرور لهذا الحساب بعد" });
        }

        const isMatch = await bcrypt.compare(password, driver.password);
        if (!isMatch) {
            return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
        }

        const token = jwt.sign(
            { id: driver.id, role: "driver", phone: driver.courierPhone },
            JWT_SECRET,
            { expiresIn: "30d" }
        );

        return res.json({ token, driverId: driver.id, name: driver.name, message: "تم تسجيل الدخول بنجاح" });
    } catch (e) {
        console.error("login error:", e);
        return res.status(500).json({ message: "خطأ في السيرفر" });
    }
};
