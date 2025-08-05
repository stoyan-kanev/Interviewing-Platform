import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {map, Observable, switchMap, tap} from 'rxjs';

interface User {
    id: number;
    email: string;
    full_name: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
    private apiUrl = 'http://127.0.0.1:8000/auth/';
    private currentUser: User | null = null;

    constructor(private http: HttpClient) {
    }

    login(email: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}login/`, {email, password}, {withCredentials: true});
    }

    register(email: string, full_name: string, password: string): Observable<User> {
        return this.http.post(`${this.apiUrl}register/`, {email, full_name, password}, {
            headers: new HttpHeaders({'Content-Type': 'application/json'}),
            withCredentials: true
        }).pipe(
            switchMap(() => this.getCurrentUser()),
        );
    }


    logout(): Observable<any> {
        return this.http.post(`${this.apiUrl}logout/`, {}, {withCredentials: true});
    }

    refresh(): Observable<any> {
        return this.http.post(`${this.apiUrl}refresh–token/`, {}, {withCredentials: true});
    }

    getCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}me/`, {withCredentials: true}).pipe(
            tap(user => this.currentUser = user)
        );
    }

    isLoggedIn(): boolean {
        return this.currentUser !== null;
    }

    getUser(): User | null {
        return this.currentUser;
    }
}
