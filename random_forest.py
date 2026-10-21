import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# =====================================
# LOAD DATASET
# =====================================

df = pd.read_csv("cstr_synthetic_dataset.csv")

print("\n======================================")
print(" CSTR THERMAL RUNAWAY PREDICTION")
print(" Random Forest Model")
print("======================================")

print("\nDataset Loaded Successfully!\n")
print(df.head())

# =====================================
# INPUT FEATURES
# =====================================

X = df[[
    "Time (min)",
    "Coolant Temp (K)",
    "Reactor Temp (K)",
    "CA (mol/L)"
]]

# =====================================
# OUTPUT LABEL
# =====================================

y = df["Condition"]

encoder = LabelEncoder()
y = encoder.fit_transform(y)

print("\nClasses Found:")
print(encoder.classes_)

# =====================================
# SPLIT DATA
# =====================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# =====================================
# TRAIN RANDOM FOREST MODEL
# =====================================

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

print("\nModel Trained Successfully!")

# =====================================
# TEST MODEL
# =====================================

y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\n======================================")
print("MODEL PERFORMANCE")
print("======================================")

print(f"\nAccuracy : {accuracy*100:.2f}%")

print("\nClassification Report:\n")
print(classification_report(y_test, y_pred, target_names=encoder.classes_))

print("\nConfusion Matrix:\n")
print(confusion_matrix(y_test, y_pred))

# =====================================
# USER PREDICTION
# =====================================

print("\n======================================")
print("ENTER NEW REACTOR VALUES")
print("======================================")

time = float(input("Enter Time (min): "))
coolant = float(input("Enter Coolant Temperature (K): "))
temperature = float(input("Enter Reactor Temperature (K): "))
ca = float(input("Enter CA Concentration (mol/L): "))

new_data = pd.DataFrame({
    "Time (min)": [time],
    "Coolant Temp (K)": [coolant],
    "Reactor Temp (K)": [temperature],
    "CA (mol/L)": [ca]
})

prediction = model.predict(new_data)

result = encoder.inverse_transform(prediction)

print("\n======================================")
print("PREDICTION RESULT")
print("======================================")
print(f"\nPredicted Reactor Condition : {result[0]}")