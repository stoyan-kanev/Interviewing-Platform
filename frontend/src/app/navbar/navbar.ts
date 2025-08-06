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
    currentUser: User | undefined;

    constructor(private authService: AuthService, private router: Router) {
    }

    ngOnInit() {
        this.authService.getCurrentUser().subscribe({
            next: user => this.currentUser = user,
            error: err => {
                if (err.status === 401) {
                    console.log('Невалиден токен, logout...');
                    this.authService.logout().subscribe(() => {
                        this.router.navigate(['/login']);
                    });
                }
            }
        });
    }


}
