export const readFile = (file) => {
    return new Promise((resolve,reject) => {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(event) {
      resolve(JSON.parse(event.target.result))   
    };
  });
}