const app = require('../api/server');

const PORT = process.env.PORT || 3456;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
