from django.urls import path

from interview_notes.views import InterviewNoteDetailAPIView, InterviewNoteListAPIView, InterviewNoteCreateAPIView, \
    InterviewNoteUpdateAPIView

urlpatterns = [
    # Main endpoint for room-specific notes (what the frontend uses)
    path('<str:room_id>/',
         InterviewNoteDetailAPIView.as_view(),
         name='interview-notes-detail'),

    # List all notes for current user
    path('user-notes/',
         InterviewNoteListAPIView.as_view(),
         name='interview-notes-list'),

    # Create new note
    path('create/',
         InterviewNoteCreateAPIView.as_view(),
         name='interview-notes-create'),

    # Update/delete specific note by ID
    path('note/<int:pk>/',
         InterviewNoteUpdateAPIView.as_view(),
         name='interview-notes-update'),
]