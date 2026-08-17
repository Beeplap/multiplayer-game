// 🎮 Mini Militia Native C++ Android Entry Point (NativeActivity + OpenGL ES 3.0)
#include <android/log.h>
#include <android_native_app_glue.h>
#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include "JetpackSoldier.hpp"

#define LOG_TAG "MiniMilitiaNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

struct EngineState {
    struct android_app* app;
    EGLDisplay display;
    EGLSurface surface;
    EGLContext context;
    int32_t width;
    int32_t height;
    bool animating;

    MiniMilitia::JetpackSoldier localPlayer;
};

// Initialize EGL Display and OpenGL ES 3.0 Context
static int engine_init_display(struct EngineState* engine) {
    const EGLint attribs[] = {
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_BLUE_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_RED_SIZE, 8,
        EGL_DEPTH_SIZE, 16,
        EGL_NONE
    };

    EGLint format;
    EGLint numConfigs;
    EGLConfig config;

    EGLDisplay display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    eglInitialize(display, nullptr, nullptr);
    eglChooseConfig(display, attribs, &config, 1, &numConfigs);
    eglGetConfigAttrib(display, config, EGL_NATIVE_VISUAL_ID, &format);

    ANativeWindow_setBuffersGeometry(engine->app->window, 0, 0, format);

    EGLSurface surface = eglCreateWindowSurface(display, config, engine->app->window, nullptr);
    const EGLint contextAttribs[] = { EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE };
    EGLContext context = eglCreateContext(display, config, nullptr, contextAttribs);

    if (eglMakeCurrent(display, surface, surface, context) == EGL_FALSE) {
        LOGE("Unable to eglMakeCurrent");
        return -1;
    }

    engine->display = display;
    engine->context = context;
    engine->surface = surface;
    eglQuerySurface(display, surface, EGL_WIDTH, &engine->width);
    eglQuerySurface(display, surface, EGL_HEIGHT, &engine->height);

    glViewport(0, 0, engine->width, engine->height);
    LOGI("Mini Militia C++ Native Engine Initialized: %dx%d", engine->width, engine->height);
    return 0;
}

// 60Hz Render & Frame Draw
static void engine_draw_frame(struct EngineState* engine) {
    if (engine->display == nullptr) return;

    // Tactical dark background
    glClearColor(0.043f, 0.055f, 0.078f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Swap buffers (VSync locked 60/120 FPS)
    eglSwapBuffers(engine->display, engine->surface);
}

// Process Android OS Commands
static void engine_handle_cmd(struct android_app* app, int32_t cmd) {
    auto* engine = (struct EngineState*)app->userData;
    switch (cmd) {
        case APP_CMD_INIT_WINDOW:
            if (engine->app->window != nullptr) {
                engine_init_display(engine);
                engine->animating = true;
            }
            break;
        case APP_CMD_TERM_WINDOW:
            engine->animating = false;
            break;
        case APP_CMD_GAINED_FOCUS:
            engine->animating = true;
            break;
        case APP_CMD_LOST_FOCUS:
            engine->animating = false;
            break;
    }
}

// Native Activity Entry Point
void android_main(struct android_app* state) {
    EngineState engine{};
    state->userData = &engine;
    state->onAppCmd = engine_handle_cmd;
    engine.app = state;

    LOGI("Starting Mini Militia NativeActivity...");

    while (true) {
        int ident;
        int events;
        struct android_poll_source* source;

        while ((ident = ALooper_pollOnce(engine.animating ? 0 : -1, nullptr, &events, (void**)&source)) >= 0) {
            if (source != nullptr) {
                source->process(state, source);
            }
            if (state->destroyRequested != 0) {
                return;
            }
        }

        if (engine.animating) {
            engine_draw_frame(&engine);
        }
    }
}
