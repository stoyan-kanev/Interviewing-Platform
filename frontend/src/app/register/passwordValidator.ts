import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

export function strongPasswordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;

        if (!value) return null;

        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasDigit = /\d/.test(value);
        const hasSpecial = /[@$!%*?&#]/.test(value);
        const isLongEnough = value.length >= 8;

        const valid = hasUpperCase && hasLowerCase && hasDigit && hasSpecial && isLongEnough;

        return valid ? null : {
            weakPassword: {
                hasUpperCase,
                hasLowerCase,
                hasDigit,
                hasSpecial,
                isLongEnough
            }
        };
    };
}
