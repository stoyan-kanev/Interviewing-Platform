import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Room = {
    updated_at: string;
    id: number;
    room_id: string;
    name: string;
    created_at: string;
    is_closed: boolean;
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

    updateRoom(id: number, data: Partial<Pick<Room, 'name' | 'is_closed'>>): Observable<Room> {
        return this.http.patch<Room>(`${this.apiUrl}/interview-rooms/${id}/`, data, { withCredentials: true });
    }

    closeInterview(id: number, closed = true): Observable<Room> {
        return this.updateRoom(id, { is_closed: closed }); // или { is_delete: closed }
    }

    deleteRoom(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/interview-rooms/${id}/`, { withCredentials: true });
    }

}
