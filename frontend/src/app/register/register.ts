import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../services/auth';
import {Router} from '@angular/router';
import {strongPasswordValidator} from './passwordValidator';
import {NgClass} from '@angular/common';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        NgClass
    ],
    templateUrl: './register.html',
    styleUrl: './register.css'
})
export class RegisterComponent {
    registerForm: FormGroup;
    isPasswordMatch: boolean | undefined;
    errorMessage: string | undefined;

    constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
        this.registerForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            full_name: ['', [Validators.required]],
            password: ['', [Validators.required, Validators.minLength(6), strongPasswordValidator()]],
            confirmPassword: ['', Validators.required]
        }, {validators: this.passwordsMatchValidator});
    }


    passwordsMatchValidator(group: FormGroup) {
        const password = group.get('password')?.value;
        const confirmPassword = group.get('confirmPassword')?.value;
        return password === confirmPassword ? null : {passwordsMismatch: true};
    }


    get email() {
        return this.registerForm.get('email')!;
    }
    get fullName() {
        return this.registerForm.get('full_name')!;
    }
    get password() {
        return this.registerForm.get('password')!;
    }
    get confirmPassword() {
        return this.registerForm.get('confirmPassword')!;
    }


    onSubmit() {

        if (this.email){
            this.errorMessage = 'Please enter a valid email';
        }
        if (this.fullName){
            this.errorMessage = 'Please enter full name';
        }

        if (!this.registerForm.valid) {
            this.registerForm.markAllAsTouched();
            return;
        }

        this.authService.register(
            this.email.value,
            this.fullName.value,
            this.password.value,
        ).subscribe({
            next: () => {
                this.authService.getCurrentUser().subscribe({
                    next: (user) => {
                        localStorage.setItem('user', JSON.stringify(user));
                        this.router.navigate(['/']);
                    },
                    error: (error) => {
                        console.error('Failed to fetch user data:', error);
                    }
                });
            },
            error: (err) => {
                const errorObj = err.error;

                if (errorObj?.errors?.email?.length > 0) {
                    const msg = errorObj.errors.email[0];

                    if (msg.includes('already exists') || msg.includes('user with this email already exists') || msg.includes('user with this email')) {
                        this.email.setErrors({ backend: 'Email already registered.' });
                    } else {
                        this.email.setErrors({ backend: msg });
                    }

                } else if (errorObj?.errors?.password) {
                    this.password.setErrors({ backend: errorObj.errors.password[0] });
                } else {
                    this.errorMessage = errorObj?.message || 'Registration failed.';
                }
            }
        });
    }

}
