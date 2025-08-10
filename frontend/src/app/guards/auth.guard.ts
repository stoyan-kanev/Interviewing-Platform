import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (_r, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.ensureSession$().pipe(
        map(ok => ok ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))
    );
};
