import {Routes} from '@angular/router';
import {RegisterComponent} from './register/register';
import {LoginComponent} from './login/login';
import {AboutComponent} from './about/about';
import {DashboardComponent} from './dashboard/dashboard';
import {authGuard} from './guards/auth.guard';
import {guestGuard} from './guards/guest.guard';
import {InterviewLobbyComponent} from './interview-lobby/interview-lobby';
import {LiveInterviewComponent} from './live-interview/live-interview';
import {Home} from './home/home';

export const routes: Routes = [
    {path: 'register', component: RegisterComponent, canActivate: [guestGuard]},
    {path: 'login', component: LoginComponent, canActivate: [guestGuard]},
    {path: '', component: Home, title: 'Interview Platform — Level up your hiring'},
    {path: 'about', component: AboutComponent, title: 'About — Interview Platform'},
    {path: 'dashboard', component: DashboardComponent, canActivate: [authGuard]},
    {path: ':room_id', component: InterviewLobbyComponent},
    {path: 'live/:room_id', component: LiveInterviewComponent},

];
