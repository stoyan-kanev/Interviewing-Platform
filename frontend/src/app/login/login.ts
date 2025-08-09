import {Component} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../services/auth';
import {Router} from '@angular/router';

@Component({
    selector: 'app-login',
    imports: [
        ReactiveFormsModule
    ],
    templateUrl: './login.html',
    styleUrl: './login.css'
})
export class LoginComponent {
    loginForm: FormGroup;
    errorMessage: string | undefined;

    constructor(private formBuilder: FormBuilder, private authService: AuthService, private router: Router) {
        this.loginForm = this.formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', Validators.required]
        })
    }

    get email() {
        return this.loginForm.get('email')!;
    }

    get password() {
        return this.loginForm.get('password')!;
    }

    onSubmit() {
        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }

        this.authService.login(
            this.email.value,
            this.password.value,
        ).subscribe(
            {
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
                        this.email.setErrors({backend: msg});

                    } else if (errorObj?.errors?.password?.length > 0) {
                        const msg = errorObj.errors.password[0];
                        this.password.setErrors({backend: msg});

                    } else {
                        const msg = errorObj?.message || errorObj?.detail || 'Invalid email or password.';
                        this.errorMessage = msg;
                    }
                }

            }
        )
    }
}
