from rest_framework import serializers
from .models import InterviewNote

class InterviewNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewNote
        fields = ['id', 'room_id', 'interviewer', 'candidate_name',
                 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


