const { Op } = require('sequelize');
const SearchableEntitiesRegistry = require('../search/searchable-entities.registry');
const AIDataRedactor = require('../ai-data-redactor.service');

/**
 * AI Tools for Global Entity Search
 */
const globalSearchTools = {
    async globalSearch(query, entityHint = null, user) {
        if (!query) return { error: 'Search query is required' };

        const results = {};
        const queryType = this._detectQueryType(query);
        
        // Priority logic: if entityHint is provided, search it first
        let entitiesToSearch = [...SearchableEntitiesRegistry];
        if (entityHint) {
            const hintIndex = entitiesToSearch.findIndex(e => 
                e.name.toLowerCase() === entityHint.toLowerCase() || 
                e.label.includes(entityHint)
            );
            if (hintIndex > -1) {
                const hintEntity = entitiesToSearch.splice(hintIndex, 1)[0];
                entitiesToSearch.unshift(hintEntity);
            }
        }

        for (const entity of entitiesToSearch) {
            // Permission check
            if (entity.permissionRoles && !entity.permissionRoles.includes(user.role)) {
                continue;
            }

            const searchWhere = this._buildWhereClause(entity, query, queryType);
            if (!searchWhere) continue;

            try {
                // Filter displayFields by actual model attributes
                const safeAttributes = this._getExistingAttributes(entity.model, entity.displayFields);

                const records = await entity.model.findAll({
                    where: searchWhere,
                    limit: 5,
                    attributes: safeAttributes
                });

                if (records && records.length > 0) {
                    results[entity.label] = records.map(record => {
                        const plain = record.toJSON ? record.toJSON() : record;
                        return this._redactGeneric(plain, user);
                    });

                    // If we had a hint and found something, stop searching other entities (Fallback logic)
                    if (entityHint && (entity.name.toLowerCase() === entityHint.toLowerCase() || entity.label.includes(entityHint))) {
                        break;
                    }
                }
            } catch (err) {
                console.error(`[AI Global Search Error] Entity: ${entity.name}`, err);
            }
        }

        if (Object.keys(results).length === 0) {
            return { message: 'لم يتم العثور على نتائج تطابق هذا البحث في أي من السجلات المتاحة.' };
        }

        return results;
    },

    _getExistingAttributes(model, requestedFields) {
        if (!model?.rawAttributes || !requestedFields) return requestedFields;
        const attrs = model.rawAttributes;
        return requestedFields.filter(field => attrs[field]);
    },

    _detectQueryType(query) {
        if (/^\b\d{14}\b$/.test(query)) return 'NID';
        if (/^01[0125]\d{8}$/.test(query)) return 'PHONE';
        if (/^\d+$/.test(query)) return 'ID_OR_CODE';
        return 'NAME_OR_STRING';
    },

    _buildWhereClause(entity, query, type) {
        const fields = entity.searchFields;
        const or = [];

        if (type === 'NID' && fields.nationalId) {
            or.push({ [fields.nationalId]: query });
        } else if (type === 'PHONE' && fields.phone) {
            or.push({ [fields.phone]: query });
        } else if (type === 'ID_OR_CODE') {
            if (fields.id) or.push({ [fields.id]: query });
            if (fields.code) or.push({ [fields.code]: query });
            if (fields.ticketNo) or.push({ [fields.ticketNo]: query });
        } else if (type === 'NAME_OR_STRING') {
            if (fields.name) or.push({ [fields.name]: { [Op.like]: `%${query}%` } });
            if (fields.code) or.push({ [fields.code]: query });
        }

        // If specific type didn't yield fields, fallback to general match
        if (or.length === 0) {
            if (fields.name) or.push({ [fields.name]: { [Op.like]: `%${query}%` } });
            if (fields.nationalId && query.length === 14) or.push({ [fields.nationalId]: query });
        }

        return or.length > 0 ? { [Op.or]: or } : null;
    },

    _redactGeneric(data, user) {
        const redacted = { ...data };
        
        // Handle common status fields mapping
        if (!redacted.status && !redacted.courierStatus && !redacted.contractStatus) {
            // If it's a Client/Vendor, use isActive
            if (redacted.isActive !== undefined) {
                redacted.status = redacted.isActive ? 'نشط' : 'غير نشط';
            } else {
                redacted.status = 'غير محدد';
            }
        } else {
            redacted.status = redacted.status || redacted.courierStatus || redacted.contractStatus;
        }

        // Dynamic redaction based on field names
        const phoneFields = ['courierPhone', 'phoneNumber', 'mobile', 'phone', 'walletNumber'];
        const nidFields = ['nationalId', 'national_id'];
        
        phoneFields.forEach(f => {
            if (redacted[f]) redacted[f] = AIDataRedactor.maskPhone(redacted[f]);
        });
        
        nidFields.forEach(f => {
            if (redacted[f]) redacted[f] = AIDataRedactor.maskNationalId(redacted[f]);
        });

        // Remove sensitive fields if they leaked into displayFields
        const blackList = ['password', 'token', 'secret', 'bankAccount', 'iban', 'courierStatus', 'contractStatus'];
        blackList.forEach(f => delete redacted[f]);

        return redacted;
    }
};

module.exports = globalSearchTools;
