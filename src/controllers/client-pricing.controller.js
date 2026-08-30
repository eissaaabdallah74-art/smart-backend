// src/controllers/client-pricing.controller.js
const db = require('../models');
const ClientPricing = db.ClientPricing;
const Hub = db.Hub;
const Zone = db.Zone;

exports.createPricing = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const {
      hub_ids,
      zone_ids,
      module,
      vehicle_type,
      fixed_salary,
      per_order_delivered,
      per_order_delivered_accepted,
      per_order_delivered_refused,
      per_order_pickup,
      guarantee_min_orders,
      guarantee_price_per_order,
      per_stop_price,
      dynamic_values,
    } = req.body;

    const pricing = await ClientPricing.create({
      clientId,
      hubId: (hub_ids && hub_ids.length === 1) ? hub_ids[0] : null,
      zoneId: (zone_ids && zone_ids.length === 1) ? zone_ids[0] : null,
      hubIds: hub_ids || null,
      zoneIds: zone_ids || null,
      module,
      vehicleType: vehicle_type,
      fixedSalary: fixed_salary || null,
      perOrderDelivered: per_order_delivered || null,
      perOrderDeliveredAccepted: per_order_delivered_accepted || null,
      perOrderDeliveredRefused: per_order_delivered_refused || null,
      perOrderPickup: per_order_pickup || null,
      guaranteeMinOrders: guarantee_min_orders || null,
      guaranteePricePerOrder: guarantee_price_per_order || null,
      perStopPrice: per_stop_price || null,
      dynamicValues: dynamic_values || null,
    });

    return res.status(201).json({
      message: 'Pricing rule created successfully',
      data: pricing,
    });
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getClientPricings = async (req, res) => {
  try {
    const clientId = req.params.clientId;

    const pricings = await ClientPricing.findAll({
      where: { clientId },
      include: [
        { model: Hub, as: 'hub', attributes: ['id', 'name'] },
        { model: Zone, as: 'zone', attributes: ['id', 'name'] },
      ],
      order: [
        ['module', 'ASC'],
        ['vehicleType', 'ASC'],
        ['hub_id', 'ASC'],
        ['zone_id', 'ASC'],
      ],
    });

    const allHubs = await Hub.findAll({ attributes: ['id', 'name'] });
    const allZones = await Zone.findAll({ attributes: ['id', 'name'] });

    const formattedPricings = pricings.map(p => {
      const plain = p.get({ plain: true });
      if (plain.hubIds && plain.hubIds.length > 0) {
        plain.hubs = allHubs.filter(h => plain.hubIds.includes(h.id));
      } else if (plain.hub) {
        plain.hubs = [plain.hub];
      } else {
        plain.hubs = [];
      }

      if (plain.zoneIds && plain.zoneIds.length > 0) {
        plain.zones = allZones.filter(z => plain.zoneIds.includes(z.id));
      } else if (plain.zone) {
        plain.zones = [plain.zone];
      } else {
        plain.zones = [];
      }
      return plain;
    });

    return res.status(200).json({
      data: formattedPricings,
    });
  } catch (error) {
    console.error('Error fetching client pricings:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updatePricing = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const pricingId = req.params.pricingId;

    const pricing = await ClientPricing.findOne({
      where: { id: pricingId, clientId },
    });

    if (!pricing) {
      return res.status(404).json({ message: 'Pricing rule not found' });
    }

    const {
      hub_ids,
      zone_ids,
      module,
      vehicle_type,
      fixed_salary,
      per_order_delivered,
      per_order_delivered_accepted,
      per_order_delivered_refused,
      per_order_pickup,
      guarantee_min_orders,
      guarantee_price_per_order,
      per_stop_price,
      dynamic_values,
    } = req.body;

    await pricing.update({
      hubId: (hub_ids && hub_ids.length === 1) ? hub_ids[0] : pricing.hubId,
      zoneId: (zone_ids && zone_ids.length === 1) ? zone_ids[0] : pricing.zoneId,
      hubIds: hub_ids !== undefined ? hub_ids : pricing.hubIds,
      zoneIds: zone_ids !== undefined ? zone_ids : pricing.zoneIds,
      module: module !== undefined ? module : pricing.module,
      vehicleType: vehicle_type !== undefined ? vehicle_type : pricing.vehicleType,
      fixedSalary: fixed_salary !== undefined ? fixed_salary : pricing.fixedSalary,
      perOrderDelivered: per_order_delivered !== undefined ? per_order_delivered : pricing.perOrderDelivered,
      perOrderDeliveredAccepted: per_order_delivered_accepted !== undefined ? per_order_delivered_accepted : pricing.perOrderDeliveredAccepted,
      perOrderDeliveredRefused: per_order_delivered_refused !== undefined ? per_order_delivered_refused : pricing.perOrderDeliveredRefused,
      perOrderPickup: per_order_pickup !== undefined ? per_order_pickup : pricing.perOrderPickup,
      guaranteeMinOrders: guarantee_min_orders !== undefined ? guarantee_min_orders : pricing.guaranteeMinOrders,
      guaranteePricePerOrder: guarantee_price_per_order !== undefined ? guarantee_price_per_order : pricing.guaranteePricePerOrder,
      perStopPrice: per_stop_price !== undefined ? per_stop_price : pricing.perStopPrice,
      dynamicValues: dynamic_values !== undefined ? dynamic_values : pricing.dynamicValues,
    });

    return res.status(200).json({
      message: 'Pricing rule updated successfully',
      data: pricing,
    });
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deletePricing = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const pricingId = req.params.pricingId;

    const pricing = await ClientPricing.findOne({
      where: { id: pricingId, clientId },
    });

    if (!pricing) {
      return res.status(404).json({ message: 'Pricing rule not found' });
    }

    await pricing.destroy();

    return res.status(200).json({ message: 'Pricing rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
