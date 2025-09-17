import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Room = {
    updated_at: string;
    id: number;
    room_id: string;
    name: string;
    created_at: string;
};

export type CreateInterviewDto = {
    room_id: number;
    candidate_name: string;
    position: string;
    date: string;
    time: string;
};

@Injectable({ providedIn: 'root' })
export class InterviewsService {
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:8000';


    getRooms(): Observable<Room[]> {
        return this.http.get<Room[]>(`${this.apiUrl}/interview-rooms/`, { withCredentials: true });
    }

    createRoom(name: string): Observable<Room> {
        return this.http.post<Room>(`${this.apiUrl}/interview-rooms/`, { name }, { withCredentials: true });
    }


    closeRoom(id: string) {
        return this.http.delete(`${this.apiUrl}/interview-rooms/` + id+'/');
    }


}
