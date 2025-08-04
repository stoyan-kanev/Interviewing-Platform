from datetime import timedelta

from django.utils.timezone import now
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import JsonResponse
from .models import User
from .serializers import UserRegisterSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = (AllowAny,)
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            data = request.data
            user = authenticate(email=data['email'], password=data['password'])
            if user is None:
                return Response({"error": "Invalid credentials"}, status=401)

            refresh = RefreshToken.for_user(user)
            response = JsonResponse({"message": "Login successful"})
            response.set_cookie(
                key='access_token',
                value=str(refresh.access_token),
                httponly=True,
                samesite='Lax'
            )
            response.set_cookie(
                key='refresh_token',
                value=str(refresh),
                httponly=True,
                samesite='Lax'
            )
            return response
        return Response(serializer.errors, status=400)

class LoginView(APIView):
    permission_classes = (AllowAny,)
    def post(self, request):
        data = request.data
        user = authenticate(email=data['email'], password=data['password'])
        if user is None:
            return Response({"error": "Invalid credentials"}, status=401)

        refresh = RefreshToken.for_user(user)
        response = JsonResponse({"message": "Login successful"})
        response.set_cookie(
            key='access_token',
            value=str(refresh.access_token),
            httponly=True,
            samesite='Lax'
        )
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            samesite='Lax'
        )
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        response = JsonResponse({"message": "Logged out"})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response

class RefreshAccessTokenView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"error": "Refresh token not found in cookies"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(refresh_token)
            new_access = refresh.access_token
            access_exp = now() + timedelta(minutes=15)

            response = Response({"message": "Access token refreshed"}, status=status.HTTP_200_OK)
            response.set_cookie(
                key='access_token',
                value=str(new_access),
                expires=access_exp,
                httponly=True,
                secure=not request.get_host().startswith("localhost"),
                samesite="Lax"
            )
            return response
        except Exception as e:
            response = Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            response.delete_cookie("access_token")
            return response
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
