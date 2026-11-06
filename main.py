from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableSequence
from langchain_groq import ChatGroq
from dotenv import load_dotenv
# Import FastAPI for handling HTTP requests and HTTPException for validation errors.
from fastapi import FastAPI
# Import Pydantic tools for checking the JSON data we receive.
from pydantic import BaseModel, Field
import requests
import sys

sys.dont_write_bytecode = True
load_dotenv()
app = FastAPI()

# Describe the JSON format we expect from the Chrome extension.
class ProcessRequest(BaseModel):
    # Require a string containing 1 to 5000 characters.
    text: str = Field(min_length=1, max_length=5000)

@app.post("/simplify")
# Define the Python function that FastAPI calls when an API request arrives.
def simplify_text(request: ProcessRequest):
        text = request.text
        prompt = PromptTemplate(template="You are an AI assistant that takes a text as a input and rewrite it in b1 level of english. Here is the text {text}", input_variables=["text"])

        model = ChatGroq(model="openai/gpt-oss-120b",
                max_tokens=500)

        parser = StrOutputParser()

        chain = RunnableSequence(prompt, model, parser)

        response = chain.invoke({"text":text})
        print(response)
        return {"response":response}

