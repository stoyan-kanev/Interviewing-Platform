from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import InterviewNote
from .serializers import InterviewNoteSerializer


class InterviewNoteDetailAPIView(APIView):
    """
    Get or Create/Update interview notes for a specific room
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        """Get notes for a specific room"""
        try:
            note = InterviewNote.objects.get(
                room_id=room_id,
                interviewer=request.user
            )
            serializer = InterviewNoteSerializer(note)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except InterviewNote.DoesNotExist:
            return Response(
                {'detail': 'No notes found for this room'},
                status=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, room_id):
        """Create or update notes for a specific room"""
        try:
            # Try to get existing note
            note = InterviewNote.objects.get(
                room_id=room_id,
                interviewer=request.user
            )
            # Update existing note
            serializer = InterviewNoteSerializer(note, data=request.data, partial=True)
        except InterviewNote.DoesNotExist:
            # Create new note
            data = request.data.copy()
            data['room_id'] = room_id
            data['interviewer'] = request.user.id
            serializer = InterviewNoteSerializer(data=data)

        if serializer.is_valid():
            serializer.save(interviewer=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InterviewNoteListAPIView(APIView):
    """
    List all interview notes for the current user
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all notes for current user"""
        notes = InterviewNote.objects.filter(interviewer=request.user)
        serializer = InterviewNoteSerializer(notes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InterviewNoteCreateAPIView(APIView):
    """
    Create a new interview note
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create a new note"""
        serializer = InterviewNoteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(interviewer=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InterviewNoteUpdateAPIView(APIView):
    """
    Update or delete a specific interview note by room_id (UUID)
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, room_id, user):
        """Helper method to get note object by room_id and interviewer"""
        try:
            return InterviewNote.objects.get(room_id=room_id, interviewer=user)
        except InterviewNote.DoesNotExist:
            return None

    def get(self, request, room_id):
        """Get specific note by room_id"""
        note = self.get_object(room_id, request.user)
        if note is None:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewNoteSerializer(note)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, room_id):
        """Update specific note by room_id"""
        note = self.get_object(room_id, request.user)
        if note is None:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewNoteSerializer(note, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, room_id):
        """Partially update specific note by room_id"""
        note = self.get_object(room_id, request.user)
        if note is None:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = InterviewNoteSerializer(note, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, room_id):
        """Delete specific note by room_id"""
        note = self.get_object(room_id, request.user)
        if note is None:
            return Response({'detail': 'Note not found'}, status=status.HTTP_404_NOT_FOUND)

        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
