from rest_framework import serializers

from interview_rooms.models import Room


class InterviewRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'
        read_only_fields = ('owner',)

