import { Component } from '@angular/core';
import {DatePipe, NgComponentOutlet, NgIf} from '@angular/common';
import {RoomDialogComponent} from '../room-dialog.component/room-dialog.component';
import {InterviewsService, Room} from '../services/interview.service';
import {RouterLink} from '@angular/router';
@Component({
  selector: 'app-dashboard',
    imports: [
        NgComponentOutlet,
        RouterLink,
        DatePipe,
    ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})


export class DashboardComponent {
    showDialog = false;
    RoomDialogComponent = RoomDialogComponent;

    userInterviewRooms :Room[] = [];



    constructor(public interviewServices: InterviewsService){}

    ngOnInit() {
        this.loadRooms()

    }

    loadRooms() {
        this.interviewServices.getRooms().subscribe(rooms => {
            this.userInterviewRooms = rooms;
        });
    }
    closeDialog = () => this.showDialog = false;


    handleRoomCreated = (room: Room) => {
        console.log('Created:', room);
        this.loadRooms();
        this.showDialog = false;
    };


}
