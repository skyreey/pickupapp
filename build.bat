@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\android-sdk"
call gradlew.bat assembleRelease -x lint -x test --configure-on-demand --build-cache
