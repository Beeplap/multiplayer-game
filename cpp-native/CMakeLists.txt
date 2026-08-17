cmake_minimum_required(VERSION 3.22.1)
project(MiniMilitiaNative VERSION 1.0.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Include header directories
include_directories(
    src/
    ${ANDROID_NDK}/sources/android/native_app_glue
)

# Source files
set(SOURCE_FILES
    src/main.cpp
    src/GameEngine.cpp
    ${ANDROID_NDK}/sources/android/native_app_glue/android_native_app_glue.c
)

# Build native shared library for Android NativeActivity
add_library(main SHARED ${SOURCE_FILES})

# Link Android NDK and OpenGL ES 3 libraries
target_link_libraries(main
    android
    log
    EGL
    GLESv3
    m
)
