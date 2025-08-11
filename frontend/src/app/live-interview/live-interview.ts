import { Component, OnInit } from '@angular/core';
import {ActivatedRoute} from '@angular/router';

@Component({
    selector: 'app-live-interview',
    templateUrl: './live-interview.html',
})
export class LiveInterviewComponent implements OnInit {
    roomId!: string;
    candidateName = '';

    constructor(private route: ActivatedRoute) {}


    ngOnInit(): void {
        this.roomId = this.route.snapshot.paramMap.get('room_id')!;
        this.candidateName = localStorage.getItem('candidate_name') || 'Анонимен';
    }
}
