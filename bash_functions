gm (){
  # goto module directory
  module_path=`python -c "import $1;print($1.__file__.rsplit('/', 1)[0])"`
  cd $module_path
}
