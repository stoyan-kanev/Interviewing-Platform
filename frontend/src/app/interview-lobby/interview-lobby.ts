import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {FormsModule} from '@angular/forms';

@Component({
    selector: 'app-interview-lobby',
    templateUrl: './interview-lobby.html',
    imports: [
        FormsModule
    ],
    styleUrls: ['./interview-lobby.css']
})
export class InterviewLobbyComponent implements OnInit {
    roomId!: string;
    roomName = '';
    candidateName = '';
    errorMessage = ''
    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.roomId = this.route.snapshot.paramMap.get('room_id')!;
        this.http
            .get<any>(`http://localhost:8000/interview-rooms/public/${this.roomId}/`)
            .subscribe({
                next: (data) => (this.roomName = data.name),
                error: () => this.router.navigate(['/']),
            });
    }

    joinInterview(): void {
        if (!this.candidateName.trim()) {
            this.errorMessage = 'Please enter a valid candidate name!';
            return;
        }

        localStorage.setItem('candidate_name', this.candidateName.trim());
        this.router.navigate(['/live', this.roomId]);
    }

}
