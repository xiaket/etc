function debian(){
    supervisorctl -c ~/.supervisord.conf $1 "debian"
}
