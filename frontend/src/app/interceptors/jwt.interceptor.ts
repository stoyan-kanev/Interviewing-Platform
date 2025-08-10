import {inject} from '@angular/core';

import {
    HttpInterceptorFn,
    HttpRequest,
    HttpHandlerFn,
    HttpEvent
} from '@angular/common/http';

import {Observable, catchError, switchMap, throwError} from 'rxjs';
import {AuthService} from '../services/auth';

export const jwtInterceptor: HttpInterceptorFn = (
    req: HttpRequest<any>,
    next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
    const authService = inject(AuthService);

    const withCredsReq = req.clone({
        withCredentials: true
    });

    return next(withCredsReq).pipe(
        catchError((error) => {
            if (error.status === 401 && !req.url.includes('/refresh-token')) {
                return authService.refresh().pipe(
                    switchMap(() => {
                        return next(req.clone({withCredentials: true}));
                    }),
                    catchError((refreshError) => {
                        authService.logout();
                        return throwError(() => refreshError);
                    })
                );
            }
            return throwError(() => error);
        })
    );
};
