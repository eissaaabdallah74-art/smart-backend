// src/controllers/landing-page-settings.controller.js
const db = require('../models');
const path = require('path');
const fs = require('fs');

exports.getSettings = async (req, res) => {
  try {
    let settings = await db.LandingPageSetting.findOne();
    if (!settings) {
      // Return defaults if none exists
      return res.json({
        ok: true,
        data: {
          badgeText: "فرصة استثنائية 🚀",
          titleHTML: "خليك <span class=\"text-gradient\">مدير نفسك</span>.. وحقق دخل يتخطى 20,000 ج.م شهرياً!",
          description: "انضم لأكبر منظومة لوجستية في مصر. بنوفرلك شغل في منطقتك، قبض أسبوعي منتظم، ودعم فني معاك 24 ساعة.",
          stats: [
            { num: "+5000", label: "شريك نجاح" },
            { num: "27", label: "محافظة" },
            { num: "أسبوعي", label: "دفعات القبض" }
          ],
          backgroundImageUrl: ""
        }
      });
    }
    return res.json({ ok: true, data: settings });
  } catch (err) {
    console.error("getSettings error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { badgeText, titleHTML, description, stats } = req.body;
    let settings = await db.LandingPageSetting.findOne();
    
    if (!settings) {
      settings = await db.LandingPageSetting.create({
        badgeText,
        titleHTML,
        description,
        stats: stats ? JSON.parse(stats) : null
      });
    } else {
      settings.badgeText = badgeText;
      settings.titleHTML = titleHTML;
      settings.description = description;
      if (stats) settings.stats = JSON.parse(stats);
      await settings.save();
    }

    if (req.file) {
      // A file was uploaded
      const filename = req.file.filename;
      const imageUrl = `/uploads/${filename}`;
      settings.backgroundImageUrl = imageUrl;
      await settings.save();
    }

    return res.json({ ok: true, data: settings, message: "Settings updated successfully" });
  } catch (err) {
    console.error("updateSettings error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};
