from datetime import timedelta

from django.conf import settings
from django.utils.timezone import now
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import authenticate
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import JsonResponse
from .serializers import UserRegisterSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            user = authenticate(
                email=request.data['email'],
                password=request.data['password']
            )
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

        return Response({
            "errors": serializer.errors
        }, status=400)
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
        try:
            refresh_token = request.COOKIES.get("refresh_token")
            if not refresh_token:
                return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()


            response = Response({"message": "Logout successful"}, status=205)

            response.delete_cookie("access_token", path="/")
            response.delete_cookie("refresh_token", path="/")
            return response
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
        })