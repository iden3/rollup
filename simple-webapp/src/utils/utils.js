export const readFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (event) {
      resolve(JSON.parse(event.target.result));
    };
  });
};
