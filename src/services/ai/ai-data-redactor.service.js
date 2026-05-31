/**
 * Service to redact sensitive data before sending it to AI providers.
 */
class AIDataRedactor {
    static maskPhone(phone) {
        if (!phone) return 'N/A';
        return phone.replace(/(\d{3})\d+(\d{3})/, '$1****$2');
    }

    static maskNationalId(id) {
        if (!id) return 'N/A';
        return id.replace(/(\d{3})\d+(\d{3})/, '$1********$2');
    }

    static maskFinancial(value) {
        return '*** (Confidential)';
    }

    /**
     * Redacts a courier object for AI context
     */
    static redactCourier(courier) {
        if (!courier) return null;
        const plain = courier.toJSON ? courier.toJSON() : courier;
        
        return {
            id: plain.id,
            name: plain.name || plain.fullNameArabic || 'N/A',
            courierCode: plain.courierCode,
            phone: this.maskPhone(plain.courierPhone),
            nationalId: this.maskNationalId(plain.nationalId),
            status: plain.contractStatus || 'active',
            clientName: plain.clientName || 'Unassigned',
            vehicleType: plain.vehicleType,
            // Financials and sensitive identifiers are ALWAYS masked for AI
            monthlySalary: '***',
            walletNumber: '***',
            bankAccountNumber: '***'
        };
    }

    /**
     * Redacts a list of objects
     */
    static redactList(list, redactorFunc, userPermissions = {}) {
        if (!Array.isArray(list)) return [];
        return list.map(item => redactorFunc.call(this, item, userPermissions));
    }
}

module.exports = AIDataRedactor;
