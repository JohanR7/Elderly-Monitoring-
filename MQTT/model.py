import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import joblib
from math import sqrt

# 1. Load your dataset
df = pd.read_csv('BP_augmented.csv')

# 2. Convert BodyTemp from Fahrenheit to Celsius (approximate)
df['BodyTempC'] = (df['BodyTemp'] - 32) * 5/9

# 3. Use only features you have and target
# Since no Sex column, add a default or drop it (here, default 0)
df['Sex'] = 0  # or 1 if you prefer

features = ['age', 'HeartRate', 'BodyTempC', 'Sex']
target = 'SBP'

X = df[features]
y = df[target]

# 4. Split dataset
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 5. Train RandomForestRegressor
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 6. Evaluate
y_pred = model.predict(X_test)
mse = mean_squared_error(y_test, y_pred)
rmse = sqrt(mse)
print(f'RandomForest RMSE: {rmse:.2f}')

# 7. Save model
joblib.dump(model, 'sbp_rf_model_realdata.joblib')
print('Model saved as sbp_rf_model_realdata.joblib')
