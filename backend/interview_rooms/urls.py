from django.urls import path

from interview_rooms.views import InterviewRoomDetail, InterviewRooms, InterviewRoomPublicAccess

urlpatterns = [
    path('', InterviewRooms.as_view(), name='room-list-create'),
    path('<int:id>/', InterviewRoomDetail.as_view(), name='room-detail'),
    path('public/<uuid:room_id>/', InterviewRoomPublicAccess.as_view()),
]
