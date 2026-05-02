// src/controllers/courier-registration.controller.js
const { CourierRegistration } = require('../models');
const { EGYPT_AREAS_AR } = require('../constants/egypt-areas');

exports.register = async (req, res) => {
  try {
    const { fullName, phoneNumber, governorate, area, vehicleType, notes } = req.body;

    if (!fullName || !phoneNumber || !governorate || !area || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (fullName, phoneNumber, governorate, area, vehicleType).',
      });
    }

    const registration = await CourierRegistration.create({
      fullName,
      phoneNumber,
      governorate,
      area,
      vehicleType,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: registration,
    });
  } catch (error) {
    console.error('Courier Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: error.message,
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const registrations = await CourierRegistration.findAll({
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      data: registrations,
    });
  } catch (error) {
    console.error('Get Courier Registrations Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching registrations.',
      error: error.message,
    });
  }
};

exports.getAreas = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: EGYPT_AREAS_AR,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching areas.',
    });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const registration = await CourierRegistration.findByPk(id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.',
      });
    }

    registration.status = status;
    await registration.save();

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully.',
      data: registration,
    });
  } catch (error) {
    console.error('Update Registration Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};
