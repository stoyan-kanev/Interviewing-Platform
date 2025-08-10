import { Component } from '@angular/core';
import {NgComponentOutlet, NgIf} from '@angular/common';
import {RoomDialogComponent} from '../room-dialog.component/room-dialog.component';
@Component({
  selector: 'app-dashboard',
    imports: [
        NgComponentOutlet,
    ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
    showDialog = false;
    RoomDialogComponent = RoomDialogComponent;


    closeDialog = () => this.showDialog = false;


    handleRoomCreated(room: any) {
        console.log('Created:', room);

    }
}
