from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from interview_rooms.models import Room
from interview_rooms.serializers import InterviewRoomSerializer


# Create your views here.

class InterviewRooms(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rooms = Room.objects.filter(owner=request.user).order_by('-id')
        serializer = InterviewRoomSerializer(rooms, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = InterviewRoomSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class InterviewRoomDetail(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, id):
        return get_object_or_404(Room, id=id, owner=request.user)

    def put(self, request, id):
        room = self.get_object(request, id)
        serializer = InterviewRoomSerializer(room, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, id):
        room = self.get_object(request, id)
        serializer = InterviewRoomSerializer(room, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        room = self.get_object(request, id)
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)