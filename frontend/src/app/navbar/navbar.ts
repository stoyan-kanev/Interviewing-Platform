import {Component} from '@angular/core';
import {AuthService} from '../services/auth';
import {User} from '../services/user.interface';
import {Observable} from 'rxjs';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';


@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './navbar.html',
    styleUrl: './navbar.css'
})
export class NavbarComponent {
    currentUser$: Observable<User | null> | undefined;

    constructor(private authService: AuthService, private router: Router) {
    }

    ngOnInit() {
        this.currentUser$ = this.authService.currentUser$

        this.authService.getCurrentUser().subscribe({
            next: () => {},
            error: err => {
                if (err.status === 401) {
                    this.authService.logout().subscribe(() => {
                        this.router.navigate(['/login']);
                    });
                }
            }
        });
    }

    logout(): void {
        this.authService.logout().subscribe(() => {
            this.router.navigate(['/login']);
        });
    }


}
