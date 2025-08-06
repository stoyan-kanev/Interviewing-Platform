import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {BehaviorSubject, map, Observable, switchMap, tap} from 'rxjs';
import {User} from './user.interface';



@Injectable({providedIn: 'root'})
export class AuthService {
    private apiUrl = 'http://localhost:8000/auth/';
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {
    }

    login(email: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}login/`, {email, password}, {withCredentials: true}).pipe(
            switchMap(() => this.getCurrentUser())
        );
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
        return this.http.post(`${this.apiUrl}logout/`, {}, { withCredentials: true }).pipe(
            tap(() => {
                this.currentUserSubject.next(null)
                localStorage.removeItem('user');

            })
        );
    }

    refresh(): Observable<any> {
        return this.http.post(`${this.apiUrl}refresh-token/`, {}, {withCredentials: true});
    }

    getCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}me/`, {withCredentials: true}).pipe(
            tap(user => this.currentUserSubject.next(user))
        );
    }
    getUser(): User | null {
        return this.currentUserSubject.value;
    }
}
