const { Driver, Interview, Employee, Client, Vendor } = require('../../../models');
const { Op } = require('sequelize');

/**
 * Registry of searchable entities with their configuration
 */
const SearchableEntitiesRegistry = [
    {
        name: 'Driver',
        label: 'مندوب / سائق',
        model: Driver,
        searchFields: {
            nationalId: 'nationalId',
            phone: 'courierPhone',
            name: 'name',
            id: 'id',
            code: 'courierCode'
        },
        displayFields: ['id', 'name', 'courierPhone', 'nationalId', 'contractStatus'],
        permissionRoles: ['admin', 'hr', 'operations_manager', 'operations']
    },
    {
        name: 'Interview',
        label: 'مقابلة / متقدم لوظيفة',
        model: Interview,
        searchFields: {
            nationalId: 'nationalId',
            phone: 'phoneNumber',
            name: 'courierName',
            id: 'id',
            ticketNo: 'ticketNo'
        },
        displayFields: ['id', 'courierName', 'phoneNumber', 'nationalId', 'courierStatus', 'ticketNo'],
        permissionRoles: ['admin', 'hr']
    },
    {
        name: 'Employee',
        label: 'موظف إداري',
        model: Employee,
        searchFields: {
            nationalId: 'nationalId',
            name: 'fullName',
            id: 'id'
        },
        displayFields: ['id', 'fullName', 'nationalId'],
        permissionRoles: ['admin', 'hr']
    },
    {
        name: 'Client',
        label: 'عميل / شركة شحن',
        model: Client,
        searchFields: {
            name: 'name',
            phone: 'phoneNumber',
            id: 'id'
        },
        displayFields: ['id', 'name', 'phoneNumber', 'isActive'],
        permissionRoles: ['admin', 'operations_manager', 'operations']
    },
    {
        name: 'Vendor',
        label: 'مورد / وكيل',
        model: Vendor,
        searchFields: {
            name: 'name',
            phone: 'mobile',
            id: 'id',
            code: 'code'
        },
        displayFields: ['id', 'name', 'mobile', 'code', 'isActive'],
        permissionRoles: ['admin', 'hr', 'operations_manager']
    }
];

module.exports = SearchableEntitiesRegistry;
