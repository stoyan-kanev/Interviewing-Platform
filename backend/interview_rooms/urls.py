from django.urls import path

from interview_rooms.views import InterviewRoomDetail, InterviewRooms

urlpatterns = [
    path('rooms/', InterviewRooms.as_view(), name='room-list-create'),
    path('rooms/<int:id>/', InterviewRoomDetail.as_view(), name='room-detail'),
]