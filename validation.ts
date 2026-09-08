export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    email?: boolean;
    phone?: boolean;
    url?: boolean;
    min?: number;
    max?: number;
    custom?: (value: any) => boolean | string;
    message?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: Record<string, string>;
    warnings: Record<string, string>;
}

export interface ValidatorSchema {
    [field: string]: ValidationRule[];
}

export class Validator {
    private rules: ValidatorSchema;
    private customMessages: Record<string, string> = {};

    constructor(schema: ValidatorSchema) {
        this.rules = schema;
    }

    /**
     * Set custom error messages for specific fields or rules
     */
    setCustomMessages(messages: Record<string, string>): void {
        this.customMessages = { ...this.customMessages, ...messages };
    }

    /**
     * Validate an object against the schema
     */
    validate(data: Record<string, any>): ValidationResult {
        const errors: Record<string, string> = {};
        const warnings: Record<string, string> = {};

        for (const [field, fieldRules] of Object.entries(this.rules)) {
            const value = data[field];
            
            for (const rule of fieldRules) {
                const error = this.validateRule(field, value, rule);
                if (error) {
                    errors[field] = error;
                    break; // Stop at first error for this field
                }
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a single field
     */
    validateField(field: string, value: any): string | null {
        const fieldRules = this.rules[field];
        if (!fieldRules) return null;

        for (const rule of fieldRules) {
            const error = this.validateRule(field, value, rule);
            if (error) return error;
        }
        return null;
    }

    private validateRule(field: string, value: any, rule: ValidationRule): string | null {
        const fieldLabel = field.charAt(0).toUpperCase() + field.slice(1);
        const defaultMessage = rule.message || `${fieldLabel} is invalid`;

        // Required check
        if (rule.required && !this.isValuePresent(value)) {
            return this.customMessages[`${field}.required`] || `${fieldLabel} is required`;
        }

        // Skip further validation if value is empty and not required
        if (!this.isValuePresent(value)) return null;

        // Min length
        if (rule.minLength !== undefined && String(value).length < rule.minLength) {
            return this.customMessages[`${field}.minLength`] || 
                `${fieldLabel} must be at least ${rule.minLength} characters`;
        }

        // Max length
        if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
            return this.customMessages[`${field}.maxLength`] || 
                `${fieldLabel} must be less than ${rule.maxLength} characters`;
        }

        // Pattern
        if (rule.pattern && !rule.pattern.test(String(value))) {
            return this.customMessages[`${field}.pattern`] || 
                `${fieldLabel} has an invalid format`;
        }

        // Email
        if (rule.email && !this.isEmail(value)) {
            return this.customMessages[`${field}.email`] || 
                `${fieldLabel} must be a valid email address`;
        }

        // Phone
        if (rule.phone && !this.isPhone(value)) {
            return this.customMessages[`${field}.phone`] || 
                `${fieldLabel} must be a valid phone number`;
        }

        // URL
        if (rule.url && !this.isUrl(value)) {
            return this.customMessages[`${field}.url`] || 
                `${fieldLabel} must be a valid URL`;
        }

        // Min
        if (rule.min !== undefined && Number(value) < rule.min) {
            return this.customMessages[`${field}.min`] || 
                `${fieldLabel} must be at least ${rule.min}`;
        }

        // Max
        if (rule.max !== undefined && Number(value) > rule.max) {
            return this.customMessages[`${field}.max`] || 
                `${fieldLabel} must be at most ${rule.max}`;
        }

        // Custom validation
        if (rule.custom) {
            const result = rule.custom(value);
            if (typeof result === 'string') {
                return result;
            } else if (result === false) {
                return defaultMessage;
            }
        }

        return null;
    }

    private isValuePresent(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    }

    private isEmail(value: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(value));
    }

    private isPhone(value: string): boolean {
        // Supports various phone formats: +1-555-123-4567, (555) 123-4567, etc.
        const phoneRegex = /^[\+\d\s\-\(\)]{7,20}$/;
        return phoneRegex.test(String(value));
    }

    private isUrl(value: string): boolean {
        try {
            new URL(String(value));
            return true;
        } catch {
            return false;
        }
    }
}

// Common validation schemas
export const CommonSchemas = {
    email: [
        { required: true },
        { email: true }
    ] as ValidationRule[],

    phone: [
        { required: true },
        { phone: true }
    ] as ValidationRule[],

    business: [
        { required: true },
        { minLength: 2 },
        { maxLength: 100 }
    ] as ValidationRule[],

    name: [
        { required: true },
        { minLength: 2 },
        { maxLength: 100 }
    ] as ValidationRule[],

    appointment: {
        business: [
            { required: true },
            { minLength: 2 },
            { maxLength: 100 }
        ],
        contactName: [
            { required: true },
            { minLength: 2 },
            { maxLength: 100 }
        ],
        phone: [
            { phone: true }
        ],
        email: [
            { email: true }
        ],
        notes: [
            { maxLength: 2000 }
        ]
    } as ValidatorSchema
};

export default Validator;