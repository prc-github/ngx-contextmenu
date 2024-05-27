robocopy dist\ngx-contextmenu dist_package\package /E /IS
cd dist_package
7z a -ttar package.tar package\
7z a -tgzip ngx-contextmenu-6.0.0.tgz package.tar
del package.tar
