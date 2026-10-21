
# 1. Import required libraries
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# 2. Load the CSTR dataset
df = pd.read_csv("cstr_dataset.csv")

# 3. Display dataset information
print("First five rows:")
print(df.head())

print("\nColumns:")
print(df.columns.tolist())

# 4. Select input features
features = [
    "Concentration",
    "Temperature",
    "Coolant_Temperature",
    "Flow_Rate",
    "Reaction_Rate",
    "Heat_Generated",
    "Heat_Removed"
]

X = df[features]

# 5. Select target output
y = df["Reactor_Status"]

# 6. Convert status labels into numeric values
# Safe = 0, Critical = 1
y = y.astype(str).str.strip().str.title().map({
    "Safe": 0,
    "Critical": 1
})

# Remove rows with missing or unrecognized target labels
valid_rows = y.notna()
X = X.loc[valid_rows]
y = y.loc[valid_rows].astype(int)

# 7. Split dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# 8. Create a pipeline with scaling and Logistic Regression
model = Pipeline([
    ("scaler", StandardScaler()),
    ("logistic_regression", LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=42
    ))
])

# 9. Train the model
model.fit(X_train, y_train)

# 10. Predict reactor status
y_pred = model.predict(X_test)

# 11. Evaluate the model
print("\nAccuracy:",
      accuracy_score(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred, labels=[0, 1]))

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred,
    labels=[0, 1],
    target_names=["Safe", "Critical"],
    zero_division=0
))

# 12. Predict a new reactor condition
new_reactor = pd.DataFrame([{
    "Concentration": 0.8,
    "Temperature": 400,
    "Coolant_Temperature": 300,
    "Flow_Rate": 1.0,
    "Reaction_Rate": 0.5,
    "Heat_Generated": 120,
    "Heat_Removed": 80
}])

prediction = model.predict(new_reactor)[0]
probability = model.predict_proba(new_reactor)[0][1]

if prediction == 1:
    print("\nPredicted Status: CRITICAL")
else:
    print("\nPredicted Status: SAFE")

print(f"Estimated critical-class probability: {probability:.2%}")
