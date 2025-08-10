import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
    BehaviorSubject,
    Observable,
    of,
    switchMap,
    tap,
    catchError,
    map,
    filter,
} from 'rxjs';
import { User } from './user.interface';

function isUser(u: User | null): u is User {
    return u !== null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = 'http://localhost:8000/auth/';
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {}

    isLoggedIn(): boolean {
        return !!this.currentUserSubject.value;
    }

    login(email: string, password: string): Observable<User> {
        return this.http
            .post(`${this.apiUrl}login/`, { email, password }, { withCredentials: true })
            .pipe(
                switchMap(() => this.getCurrentUser()),
                filter(isUser)
            );
    }

    register(email: string, full_name: string, password: string): Observable<User> {
        return this.http
            .post(
                `${this.apiUrl}register/`,
                { email, full_name, password },
                { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), withCredentials: true }
            )
            .pipe(
                switchMap(() => this.getCurrentUser()),
                filter(isUser)
            );
    }

    logout(): Observable<any> {
        return this.http.post(`${this.apiUrl}logout/`, {}, { withCredentials: true }).pipe(
            tap(() => {
                this.currentUserSubject.next(null);
                localStorage.removeItem('user');
            })
        );
    }

    refresh(): Observable<any> {
        return this.http.post(`${this.apiUrl}refresh-token/`, {}, { withCredentials: true });
    }

    getCurrentUser(): Observable<User | null> {
        return this.http.get<User>(`${this.apiUrl}me/`, { withCredentials: true }).pipe(
            tap((user) => this.currentUserSubject.next(user)),
            catchError(() => {
                this.currentUserSubject.next(null);
                return of(null);
            })
        );
    }

    ensureSession$(): Observable<boolean> {
        return this.isLoggedIn() ? of(true) : this.getCurrentUser().pipe(map((u) => !!u));
    }

    getUser(): User | null {
        return this.currentUserSubject.value;
    }
}
